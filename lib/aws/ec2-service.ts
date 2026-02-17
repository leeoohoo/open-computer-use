import {
  EC2Client,
  RunInstancesCommand,
  DescribeInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
  CreateKeyPairCommand,
  DeleteKeyPairCommand,
  CreateSecurityGroupCommand,
  AuthorizeSecurityGroupIngressCommand,
  DescribeSecurityGroupsCommand,
  DescribeImagesCommand,
  type Instance,
  type _InstanceType,
} from "@aws-sdk/client-ec2";

export interface EC2InstanceConfig {
  name?: string;
  instanceType?: string;
  amiId?: string;
  storageGb?: number;
}

export interface EC2InstanceStatus {
  state: "creating" | "running" | "stopped" | "failed";
  ipAddress?: string;
  publicDnsName?: string;
  message?: string;
}

export interface EC2CreateResult {
  instanceId: string;
  keyPairName: string;
  privateKeyPem: string;
}

export class AwsEc2Service {
  private client: EC2Client;
  private region: string;
  private cachedSecurityGroupId: string | null = null;
  private cachedAmiId: string | null = null;

  constructor() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    const region = process.env.AWS_REGION || "us-east-1";

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables are required"
      );
    }

    this.region = region;
    this.client = new EC2Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  async createInstance(
    userId: string,
    config: EC2InstanceConfig
  ): Promise<EC2CreateResult> {
    const maxRetries = 3;
    const baseDelay = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.createInstanceInternal(userId, config);
      } catch (error: any) {
        const isLastAttempt = attempt === maxRetries;

        if (!this.isRetryableError(error) || isLastAttempt) {
          console.error(
            `AWS EC2 instance creation failed after ${attempt} attempts:`,
            error
          );
          throw error;
        }

        const delay =
          baseDelay * Math.pow(2, attempt - 1) + Math.random() * 1000;
        console.log(
          `AWS EC2 creation failed (attempt ${attempt}/${maxRetries}), retrying in ${Math.round(delay)}ms...`,
          { error: error.message, code: error.code }
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error("EC2 instance creation failed after all retry attempts");
  }

  private async createInstanceInternal(
    userId: string,
    config: EC2InstanceConfig
  ): Promise<EC2CreateResult> {
    const instanceType = config.instanceType || process.env.AWS_EC2_INSTANCE_TYPE || "t4g.nano";
    const storageGb = config.storageGb || 8;

    // Ensure security group exists
    const securityGroupId = await this.ensureSecurityGroup();

    // Generate key pair
    const keyPrefix = process.env.AWS_EC2_KEY_PREFIX || "llmhub";
    const shortId = `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const keyPairName = `${keyPrefix}-${userId.substring(0, 8)}-${shortId}`;

    const createKeyResult = await this.client.send(
      new CreateKeyPairCommand({
        KeyName: keyPairName,
        KeyType: "ed25519",
      })
    );

    const privateKeyPem = createKeyResult.KeyMaterial;
    if (!privateKeyPem) {
      throw new Error("Failed to generate SSH key pair: no key material returned");
    }

    // Resolve AMI
    const amiId = config.amiId || process.env.AWS_EC2_AMI_ID || (await this.resolveUbuntuAmi());

    // Build instance name tag
    const instanceName = config.name || `llmhub-${userId.substring(0, 8)}-${shortId}`;

    // Launch instance
    const runResult = await this.client.send(
      new RunInstancesCommand({
        ImageId: amiId,
        InstanceType: instanceType as _InstanceType,
        MinCount: 1,
        MaxCount: 1,
        KeyName: keyPairName,
        SecurityGroupIds: [securityGroupId],
        BlockDeviceMappings: [
          {
            DeviceName: "/dev/sda1",
            Ebs: {
              VolumeSize: storageGb,
              VolumeType: "gp3",
              DeleteOnTermination: true,
            },
          },
        ],
        TagSpecifications: [
          {
            ResourceType: "instance",
            Tags: [
              { Key: "Name", Value: instanceName },
              { Key: "UserId", Value: userId },
              { Key: "ManagedBy", Value: "llmhub" },
            ],
          },
        ],
      })
    );

    const instanceId = runResult.Instances?.[0]?.InstanceId;
    if (!instanceId) {
      // Clean up key pair if instance launch failed
      await this.client.send(
        new DeleteKeyPairCommand({ KeyName: keyPairName })
      ).catch(() => {});
      throw new Error("Failed to launch EC2 instance: no instance ID returned");
    }

    return {
      instanceId,
      keyPairName,
      privateKeyPem,
    };
  }

  async getInstanceStatus(instanceId: string): Promise<EC2InstanceStatus> {
    try {
      const result = await this.client.send(
        new DescribeInstancesCommand({
          InstanceIds: [instanceId],
        })
      );

      const instance = result.Reservations?.[0]?.Instances?.[0];
      if (!instance) {
        return { state: "failed", message: "Instance not found" };
      }

      return this.mapInstanceState(instance);
    } catch (error: any) {
      if (error.name === "InvalidInstanceID.NotFound") {
        return { state: "failed", message: "Instance not found" };
      }
      throw error;
    }
  }

  async startInstance(instanceId: string): Promise<void> {
    await this.client.send(
      new StartInstancesCommand({
        InstanceIds: [instanceId],
      })
    );
  }

  async stopInstance(instanceId: string): Promise<void> {
    await this.client.send(
      new StopInstancesCommand({
        InstanceIds: [instanceId],
      })
    );
  }

  async terminateInstance(
    instanceId: string,
    keyPairName?: string
  ): Promise<void> {
    await this.client.send(
      new TerminateInstancesCommand({
        InstanceIds: [instanceId],
      })
    );

    // Clean up key pair
    if (keyPairName) {
      try {
        await this.client.send(
          new DeleteKeyPairCommand({ KeyName: keyPairName })
        );
      } catch (error) {
        console.error("Failed to delete key pair:", error);
      }
    }
  }

  private async ensureSecurityGroup(): Promise<string> {
    if (this.cachedSecurityGroupId) {
      return this.cachedSecurityGroupId;
    }

    const sgName = process.env.AWS_EC2_SECURITY_GROUP_NAME || "llmhub-ec2-ssh";

    // Check if security group exists
    try {
      const describeResult = await this.client.send(
        new DescribeSecurityGroupsCommand({
          Filters: [
            { Name: "group-name", Values: [sgName] },
          ],
        })
      );

      if (describeResult.SecurityGroups && describeResult.SecurityGroups.length > 0) {
        this.cachedSecurityGroupId = describeResult.SecurityGroups[0].GroupId!;
        return this.cachedSecurityGroupId;
      }
    } catch (error) {
      // Group doesn't exist, create it
    }

    // Create security group
    const createResult = await this.client.send(
      new CreateSecurityGroupCommand({
        GroupName: sgName,
        Description: "LLMHub EC2 SSH access",
      })
    );

    const groupId = createResult.GroupId;
    if (!groupId) {
      throw new Error("Failed to create security group");
    }

    // Allow SSH inbound
    await this.client.send(
      new AuthorizeSecurityGroupIngressCommand({
        GroupId: groupId,
        IpPermissions: [
          {
            IpProtocol: "tcp",
            FromPort: 22,
            ToPort: 22,
            IpRanges: [{ CidrIp: "0.0.0.0/0", Description: "SSH access" }],
          },
        ],
      })
    );

    this.cachedSecurityGroupId = groupId;
    return groupId;
  }

  private async resolveUbuntuAmi(): Promise<string> {
    if (this.cachedAmiId) {
      return this.cachedAmiId;
    }

    const result = await this.client.send(
      new DescribeImagesCommand({
        Filters: [
          {
            Name: "name",
            Values: ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-arm64-server-*"],
          },
          { Name: "state", Values: ["available"] },
          { Name: "architecture", Values: ["arm64"] },
        ],
        Owners: ["099720109477"], // Canonical's AWS account ID
      })
    );

    const images = result.Images || [];
    if (images.length === 0) {
      throw new Error(
        `No Ubuntu 22.04 ARM64 AMI found in region ${this.region}. Set AWS_EC2_AMI_ID manually.`
      );
    }

    // Sort by creation date descending, pick the latest
    images.sort((a, b) => {
      const dateA = a.CreationDate || "";
      const dateB = b.CreationDate || "";
      return dateB.localeCompare(dateA);
    });

    this.cachedAmiId = images[0].ImageId!;
    console.log(`Resolved Ubuntu 22.04 ARM64 AMI: ${this.cachedAmiId}`);
    return this.cachedAmiId;
  }

  private mapInstanceState(instance: Instance): EC2InstanceStatus {
    const stateName = instance.State?.Name;
    const ipAddress = instance.PublicIpAddress;
    const publicDnsName = instance.PublicDnsName;

    let state: EC2InstanceStatus["state"];
    let message: string | undefined;

    switch (stateName) {
      case "pending":
        state = "creating";
        message = "Instance is starting up...";
        break;
      case "running":
        state = "running";
        message = "Instance is running";
        break;
      case "stopping":
        state = "stopped";
        message = "Instance is stopping...";
        break;
      case "stopped":
        state = "stopped";
        message = "Instance is stopped";
        break;
      case "shutting-down":
      case "terminated":
        state = "failed";
        message = "Instance has been terminated";
        break;
      default:
        state = "creating";
        message = `Instance state: ${stateName}`;
    }

    return { state, ipAddress, publicDnsName, message };
  }

  private isRetryableError(error: any): boolean {
    if (
      error.code === "ECONNRESET" ||
      error.code === "ETIMEDOUT" ||
      error.code === "ECONNREFUSED" ||
      error.code === "ENOTFOUND" ||
      error.code === "ENETUNREACH"
    ) {
      return true;
    }

    if (error.$metadata?.httpStatusCode) {
      return [429, 502, 503, 504].includes(error.$metadata.httpStatusCode);
    }

    if (
      error.name === "RequestLimitExceeded" ||
      error.name === "Throttling" ||
      error.name === "InternalError"
    ) {
      return true;
    }

    return false;
  }

  estimateCost(instanceType: string, hours: number): number {
    const prices: Record<string, number> = {
      "t4g.nano": 0.0042,
      "t4g.micro": 0.0084,
      "t4g.small": 0.0168,
      "t4g.medium": 0.0336,
    };
    return parseFloat(((prices[instanceType] || 0.0042) * hours).toFixed(4));
  }
}

// Singleton instance
let awsService: AwsEc2Service | null = null;

export function getAwsEc2Service(): AwsEc2Service {
  if (!awsService) {
    awsService = new AwsEc2Service();
  }
  return awsService;
}

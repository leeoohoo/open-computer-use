# Security Policy

## Supported Versions

We take security seriously and actively maintain the following versions:

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < 1.0   | :x:                |

We recommend always using the latest version to ensure you have the most recent security patches and updates.

---

## Reporting a Vulnerability

**Please do NOT report security vulnerabilities through public GitHub issues.**

### How to Report

If you discover a security vulnerability, please report it to:

**Email**: prateek@coasty.ai

**Subject**: [SECURITY] Brief description of the issue

### What to Include

Please provide as much information as possible to help us understand and resolve the issue:

1. **Description**: Clear description of the vulnerability
2. **Impact**: What could an attacker achieve?
3. **Steps to Reproduce**: Detailed steps to reproduce the issue
4. **Proof of Concept**: Code snippets, screenshots, or logs
5. **Environment**: OS, browser, Node.js/Python versions
6. **Suggested Fix**: If you have ideas on how to fix it
7. **Severity**: Your assessment of the severity (Critical/High/Medium/Low)

### Example Report

```
Subject: [SECURITY] SQL Injection in user profile endpoint

Description:
The /api/user/profile endpoint is vulnerable to SQL injection through the
'username' parameter.

Impact:
An attacker could read, modify, or delete database records, potentially
accessing sensitive user data or taking over accounts.

Steps to Reproduce:
1. Navigate to http://localhost:3000/api/user/profile
2. Send POST request with payload: {"username": "admin' OR '1'='1"}
3. Observe unauthorized data access

Proof of Concept:
[Attach screenshot or code snippet]

Environment:
- OS: Ubuntu 22.04
- Node.js: 20.10.0
- Browser: Chrome 120

Severity: Critical
```

---

## Response Process

### What to Expect

1. **Acknowledgment**: We'll acknowledge receipt within **24 hours**
2. **Initial Assessment**: We'll assess severity and impact within **48 hours**
3. **Status Updates**: We'll keep you informed of our progress
4. **Fix Development**: We'll work on a fix and coordinate disclosure timing
5. **Public Disclosure**: We'll publicly disclose after the fix is deployed

### Timeline

- **Critical vulnerabilities**: Fix within 7 days
- **High severity**: Fix within 14 days
- **Medium severity**: Fix within 30 days
- **Low severity**: Fix in next regular release

---

## Security Features

### Current Security Measures

#### 1. Authentication & Authorization
- Supabase Auth with Row Level Security (RLS)
- JWT-based session management
- Encrypted API keys storage (BYOK)
- CSRF protection on all state-changing operations

#### 2. Data Protection
- API keys encrypted with AES-256 (ENCRYPTION_KEY)
- Passwords hashed with bcrypt
- Secure session cookies (httpOnly, secure, sameSite)
- Environment variables for sensitive data

#### 3. VM Isolation
- Docker container sandboxing
- Network isolation options
- Resource limits (CPU, memory, disk)
- Ephemeral environments (no data persistence)
- Automated cleanup after sessions

#### 4. Input Validation
- Pydantic models for request validation
- TypeScript strict mode
- SQL injection prevention (parameterized queries)
- XSS protection (sanitized outputs)
- File path validation

#### 5. Rate Limiting
- API endpoint rate limiting
- WebSocket connection limits
- VM creation throttling
- Resource usage monitoring

#### 6. Monitoring & Logging
- Security event logging
- Error tracking
- Access logs (anonymized)
- Anomaly detection

---

## Security Best Practices for Users

### For Developers

1. **Environment Variables**
   - Never commit `.env` files
   - Use `.env.example` as a template
   - Rotate credentials regularly
   - Use strong, unique passwords

2. **API Keys**
   - Store in environment variables only
   - Enable encryption (ENCRYPTION_KEY)
   - Never log API keys
   - Use least-privilege access

3. **VM Security**
   - Don't store sensitive data in VMs
   - Use isolated networks when possible
   - Monitor resource usage
   - Clean up containers regularly

4. **Code Security**
   - Review generated commands before execution
   - Validate all user inputs
   - Use parameterized queries
   - Sanitize file paths
   - Keep dependencies updated

### For Self-Hosting

1. **Network Security**
   - Use HTTPS in production
   - Configure firewall rules
   - Restrict VM network access
   - Use VPNs for remote access

2. **Container Security**
   - Keep Docker images updated
   - Use non-root users in containers
   - Scan images for vulnerabilities
   - Limit container capabilities

3. **Database Security**
   - Enable Supabase RLS policies
   - Use strong database passwords
   - Backup regularly
   - Monitor access logs

4. **Server Hardening**
   - Keep OS and packages updated
   - Disable unnecessary services
   - Configure fail2ban or similar
   - Use SSH keys (not passwords)

---

## Known Security Considerations

### By Design

1. **VM Access**: Agents have full control within VMs by design
2. **Command Execution**: Terminal agent can execute any command
3. **Browser Automation**: Browser agent can visit any website
4. **User Responsibility**: Users are responsible for agent actions

### Mitigations

- VMs are isolated and ephemeral
- Resource limits prevent abuse
- Rate limiting prevents spam
- Monitoring detects anomalies
- User consent required for actions

---

## Vulnerability Disclosure Policy

### Coordinated Disclosure

We follow **coordinated disclosure**:

1. **Report received**: Vulnerability reported privately
2. **Fix developed**: We develop and test a fix
3. **Fix deployed**: Patch released to all users
4. **Public disclosure**: Details published after 90 days

### Recognition

We appreciate security researchers who help keep our users safe:

- **Hall of Fame**: Public recognition on our website
- **Credit**: Listed in release notes and security advisories
- **Swag**: Open Computer Use swag for significant findings

*Note: We currently don't offer a bug bounty program, but we deeply value your contributions.*

---

## Security Advisories

Security advisories will be published at:
- GitHub Security Advisories
- Release notes
- Discord announcements
- Email to registered users

Subscribe to our [GitHub releases](https://github.com/coasty-ai/open-computer-use/releases) to stay informed.

---

## Security Updates

### How We Communicate

- **GitHub**: Security advisories and releases
- **Discord**: #security-updates channel
- **Email**: Critical alerts to registered users
- **Twitter**: @llmhub_dev for major updates

### Staying Secure

1. **Update regularly**: `git pull && npm install && pip install -r requirements.txt`
2. **Watch releases**: Enable GitHub notifications
3. **Join Discord**: Get real-time security updates

---

## Compliance

### Standards We Follow

- **OWASP Top 10**: Web application security risks
- **CWE Top 25**: Common software weaknesses
- **NIST Cybersecurity Framework**: Security best practices
- **GDPR**: Data protection and privacy (for EU users)
- **CCPA**: Privacy rights (for California users)

### Certifications

We're working towards:
- SOC 2 Type II compliance
- ISO 27001 certification
- GDPR compliance audit

---

## Security Audit History

| Date | Type | Auditor | Findings | Status |
|------|------|---------|----------|--------|
| TBD | External | TBD | TBD | Planned |

*We plan to conduct regular security audits as the project grows.*

---

## Security Team

### Contact

- **Security Lead**: Prateek Jannu (prateek@coasty.ai)
- **General Security**: prateek@coasty.ai
- **PGP Key**: [Coming soon]

### Response Team

Our security team includes:
- Core maintainers
- Security advisors
- Community contributors

---

## Additional Resources

### Security Documentation

- [Responsible Use Guidelines](RESPONSIBLE_USE.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Privacy Policy](https://coasty.ai/privacy)
- [Terms of Service](https://coasty.ai/terms)

### External Resources

- [OWASP Cheat Sheets](https://cheatsheetseries.owasp.org/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Supabase Security](https://supabase.com/docs/guides/platform/security)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## Questions?

Have questions about our security practices?

- **Email**: security@coasty.ai
- **Discord**: [Join our server](https://discord.gg/gppEfsVt)
- **Discussions**: [GitHub Discussions](https://github.com/coasty-ai/open-computer-use/discussions)

---

**Thank you for helping keep Open Computer Use and our users safe!** 🔒

*Last updated: October 2025*

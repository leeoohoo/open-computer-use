export interface UserSecret {
  id: string
  name: string
  service: string
  username: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface UserSecretWithPassword extends UserSecret {
  password: string
}

export interface CreateSecretRequest {
  name: string
  service: string
  username: string
  password: string
  notes?: string
}

export interface UpdateSecretRequest {
  name?: string
  service?: string
  username?: string
  password?: string
  notes?: string
}

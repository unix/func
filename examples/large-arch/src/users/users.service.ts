import { Service } from 'func'

@Service()
export class UsersService {
  list(role: string) {
    return [
      `ada (${role})`,
      `grace (${role})`,
    ]
  }

  invite(role: string) {
    return `created invite for ${role}`
  }
}

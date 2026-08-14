import { Injectable } from 'func'

@Injectable()
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

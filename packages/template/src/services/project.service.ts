import { Injectable } from 'func'
import { appName } from '../config'

@Injectable()
export class ProjectService {
  name() {
    return appName
  }
}

import { Injectable } from 'func'

@Injectable()
export class ReportsService {
  summary(period: string) {
    return `report summary for ${period}`
  }

  export(period: string) {
    return `exported ${period} report`
  }
}

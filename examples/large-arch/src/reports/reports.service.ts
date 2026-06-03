import { Service } from 'func'

@Service()
export class ReportsService {
  summary(period: string) {
    return `report summary for ${period}`
  }

  export(period: string) {
    return `exported ${period} report`
  }
}

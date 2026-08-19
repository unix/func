import { Module } from '../../application/definition'
import { MODULE_OPTION } from '../../options/module-option'
import { JsonOutput } from './runtime'

const jsonOption = Object.freeze({
  aliases: [],
  description: 'output JSON',
  name: 'json',
  type: Boolean,
})

@Module({
  exports: [JsonOutput, MODULE_OPTION],
  name: 'JsonOutputModule',
  providers: [
    JsonOutput,
    {
      provide: MODULE_OPTION,
      useValue: jsonOption,
    },
  ],
})
export class JsonOutputModule {}

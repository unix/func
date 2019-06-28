
# Quick-start Guide
## Create Project
The `func` provides the installation script and the default template of an item. 
If you want to create an item, you only need one command to complete it:

```bash
npm init func
```
::: tip
require your `npm` of version > 6.1.0 。
:::

## Rapid Development

After entering the item just initialized, you can see the following item structure:

```
|--src
    |--commands         
    |--options          
    |--index.ts         // entry
|--tests
|--package.json
```

You can start development by running the following commands:
```bash
npm i && npm start
```

So far, all the preparations have been completed, you can browse the examples in `commands` / `options`, 
try to modify them and make your commands run to see how it goes.

Someone may wonder what is my command? 
In fact, it is the name of your folder. You can notice that there is the item of `bin` in `package.json`, which is used to define your command.
The default is your item name (assigned when the template was initialized). 
Certainly, you can modify it at any time, only if you don't forget to run `npm start` once for initialization after it's modified.

## Bundle

If you use the template to create an item, you only need to execute one command to package the item:

```bash
npm build
```
It is very simple, isn't it? Run `npm build`, then you can get a packaged file, and also the `bin` is well-handled for you. 
Without necessarily considering anything, try publishing it directly.

:::warning
After build is run, the item will point to production. If you need to return to the mode of development, still run `npm start`.
:::

## Publish

You can learn more techniques of publishing with reference to [How to publish documents](/publish.md), 
but now we don't have to care too much, try publishing your package directly on NPM with `npm publish`!

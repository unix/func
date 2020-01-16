
# Quick-start Guide
## Create Project
The `func` provides the default template:

```bash
npm init func
```

<br/>
<img src="hello-func-1.png" width="420">

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

Enter the command to start:
```bash
npm i && npm start
```

<br/>
<img src="hello-func-2.png" width="420">

So far, all the preparations have been completed.

You can browse the examples in `commands` / `options`,
try to modify them and make your commands run to see how it goes.

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

Try publishing your package directly on NPM with `npm publish`!

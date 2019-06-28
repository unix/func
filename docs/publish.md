
# Publish Practice

This is the discussion of experience and practice, just a recommendation. 
If you want, you can totally skip this section and publish it in the way you like.

## Package and Publish Package

At present, the `func` template item has contained the tool `func-service`, 
which allows you to package your commands into a single file with one key. 
In most cases, you only need to run one command to complete the packaging:

```ts
npm build
```
Then only `npm publish` is required to be run to publish the package to NPM. 
If you are using another platform for package management, publish the `dist` folder.

In very few cases, if your codes contains a way to introduce dynamic characters strings (such as `require(${var}something${version})`),
which may cause packaging to fail because the file location cannot be correctly identified with the bundle tool
and the package name can only be determined when the codes are run. Encountering this situation, you have several options:

- Replacing with a static package name (best option)
- Manually inspecting the path and move all dependent dynamic packages into `dist`
- Writing a script for dynamic webpack packaging by yourself

## Publish Fewer Files

We know that when most command-line tools are used, in addition to the running speed, 
the installation speed is also the focus of attention. 
Learning how to reduce the time of downloading a package will help your users obtain a better experience.

- Use the constraint of `files`.

  The option of `files` in the `package.json` is used to constrain how many files can be published. 
Under normal circumstances you only need to carry the `dist` folder. Like the `src` / `docs`, etc.,
these files are not actually run after the bundle, and publishing them together has no effect on the user.

- Use HTTP requests.

  When you encounter a large file or configuration, you can consider not introducing it, 
but requesting the server to load via HTTP, which will greatly reduce the volume of the package. 
That also certainly depends on your business logic, which requires your own careful thinking.
  
- Don't use those packages that are too dependent.

  For some third-party packages, only an extremely simple function is completed, but the volume is amazing. 
When developing command-line tools, please pay attention to whether there are many dependencies for those packages and 
whether their volume is much great, etc.
  
- Try moving the dependency into `devDependencies`.

  That is a dangerous conduct, but it works well in the items built by `func`, 
which is because `func` will package all the files of the command lines together, 
and the dependencies will lose their effect during the running. 
Placing them intothe development dependencies `devDependencies` can avoid the time it takes for NPM to compare against 
the dependencies versions when downloading.


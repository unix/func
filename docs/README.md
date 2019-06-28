
# About func
## What is func

  `func` is a modern command line framework that is lighter and more elegant compared with other products, 
with more scaffolding support and an excellent developer experience at the same time.
  
  `func` is realized by using `TypeScript`, which is easier to maintain and extend. Due to type support, 
you can get almost all the grammar tips. But don't worry, it's not complicated. 
Only one command is required from development to packaging. 
Developers at almost any level can easily use `func` to build modern command line tools without requiring any learning costs.

  You can create an item in seconds with reference to the documentation of [Quick-start Guide] (/guide.md).

## Function of Unique Features

  - Volume of very small packaging -- Volume of complete application built with `func`≈ [7kb](https://github.com/WittBulter/func/blob/master/examples/gzbundle/archived.tar.gz)

  - Elegant grammar and item structure without any thinking burden
  
  - Very few dependence, maximum optimized running speed and `npm` download time
  
  - With the support of a complete template, one key can develop.
  
  - Functions are not stacked. We polish every detail, absolutely without randomly stacking functions.

## Why func ?

Actually, I wrote a lot of command-line tools, but it's difficult to find a command-line framework that 
I am completely satisfied with in the open source community. Certainly, this does not mean that `func` is perfect. 
On the contrary, `func` has many defects, For example, there are no color output being automatically provided, 
no API interface for programming and no configuration files for so-called automated parsing, etc., 
**but with which at least one thing has been done well, and the thing is done carefully enough to be easy to use,
which is enough for me (or a lot of people). **

For command-line developers, many things can be DIY or developed by using the third-party library in the community. 
How to consider and judge it depends on the developer itself. It is a very irresponsible conduct to plug all the functions to the developer,
especially for users who have the requirements of performance and volume. 

For the `func`, using the decorator's metadata to help command define is a very lightweight choice actually, 
**when most of the codes will not be brought into the running after the build**,
it also provides a very good development experience (such as tips, classes, item design, etc.), 
which greatly improves the current situation of the command lines items that are so chaos that it is difficult to maintain. 

If you have any items that need to be rebuilt or started with a new item from the very beginning,
then `func` is a very good choice, making the command-line tool built in a happy and simple manner with rich spirituality.

## About Future

`func` will also have version iterations, but I will carefully consider and judge `Feature` to make sure it doesn't become a burden for everyone. 
Prior to the updates of all `Feature`, a `Feature Request` are created in the [Issue](https://github.com/WittBulter/func/issues) area of an item. 
Of course, you can also come up with your own ideas.

Only after the discussion and review in the community, it can be realized in the next version.

At any time, the plan for the `func` project is aimed at the developer experience and user experience, 
which is the most important rule and goal of the project. All the improvements are also developed around this point. 
We have some long-term plans for preview, and you are welcome to leave your suggestions based on this:

- Improve the effect of type tips.

  It seems that this is well-done at present, but there are still room for improvement, 
such as detailed tips on parameters, constraints on the `Option` type and so on.
  
- Open interface and ecosystem

  While keeping the ontology simplified enough, you can extend the API for the use of removable plugins.
  
- Strengthening the scaffolding

  Enrich the template and test cases of `func` and strengthen the development experience provided by `func-service`, which is a long-term plan.


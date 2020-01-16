module.exports = {
  title: 'func - modern command-line framework',
  description: '',
  head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: './favicon.ico' }],
  ],
  locales: {
    '/': {
      lang: 'en-US',
      title: 'func - modern command-line framework',
      description: 'func - modern command-line framework',
    },
    '/zh/': {
      lang: 'zh-CN',
      title: 'func - 现代化命令行框架',
      description: 'func - 现代化命令行框架',
    },
  },
  theme: 'zeit',
  themeConfig: {
    repo: 'unix/func',
    docsDir: 'docs',
    editLinks: true,
    lastUpdated: 'Last Updated',
    highlightCode: true,
    locales: {
      '/': {
        nav: [
          { text: 'Guide', link: '/guide' },
          { text: 'Github', link: 'https://github.com/unix/func' },
        ],
        sidebar: {
          '/': [
            '/',
            '/guide',
            './command',
            './params',
            './apis',
          ],
        },
      },
      '/zh/': {
        docsDir: 'docs/zh',
        selectText: '选择语言',
        label: '简体中文',
        nav: [
          { text: '快速开始', link: '/zh/guide' },
          { text: '项目', link: 'https://github.com/unix/func' },
        ],
        sidebar: {
          '/zh/': [
            '/zh/',
            '/zh/guide',
            '/zh/command',
            '/zh/params',
            '/zh/apis',
          ],
        },
      },
    },
  },
  plugins: [
    [
      '@vuepress/google-analytics',
      {
        'ga': 'UA-110371817-9',
      },
    ],
  ],
}

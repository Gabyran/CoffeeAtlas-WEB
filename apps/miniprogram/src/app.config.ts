export default defineAppConfig({
  pages: [
    'pages/onboarding/index',
    'pages/onboarding-guided/index',
    'pages/all-beans/index',
    'pages/index/index',
    'pages/profile/index',
    'pages/bean-detail/index',
    'pages/roaster-detail/index',
    'wxpages/badge-3d/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: 'CoffeeAtlas',
    navigationBarTextStyle: 'black',
  },
  tabBar: {
    color: '#8b5a2b',
    selectedColor: '#3d2b1f',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/all-beans/index',
        text: '选豆',
      },
      {
        pagePath: 'pages/index/index',
        text: '新品',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
      },
    ],
  },
})

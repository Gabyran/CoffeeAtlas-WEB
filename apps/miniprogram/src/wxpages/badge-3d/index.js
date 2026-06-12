var BADGE_MODEL_URLS = {
  visitor: 'https://atlas.bequer.cloud/visitor-badge.glb'
}

var BADGE_TITLES = {
  visitor: '入馆访客'
}

function compareVersion(v1, v2) {
  var a1 = v1.split('.').map(Number)
  var a2 = v2.split('.').map(Number)
  var len = Math.max(a1.length, a2.length)
  for (var i = 0; i < len; i++) {
    var n1 = a1[i] || 0
    var n2 = a2[i] || 0
    if (n1 > n2) return true
    if (n1 < n2) return false
  }
  return true
}

Page({
  data: {
    statusBarHeight: 0,
    badgeTitle: '',
    badgeId: '',
    modelUrl: '',
    loading: true,
    error: false,
    errorMessage: '',
    showHint: true
  },

  onLoad: function (options) {
    var sysInfo = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync()
    var badgeId = options.badgeId || ''
    var title = BADGE_TITLES[badgeId] || '3D 徽章'
    var url = BADGE_MODEL_URLS[badgeId] || ''

    // 检查 xr-frame 支持
    var systemInfo = wx.getSystemInfoSync()
    var sdkVersion = systemInfo.SDKVersion || ''
    if (!compareVersion(sdkVersion, '2.27.1')) {
      this.setData({
        error: true,
        errorMessage: '当前微信版本不支持 3D 查看器，请升级微信后重试。',
        loading: false
      })
      return
    }

    if (!url) {
      this.setData({
        error: true,
        errorMessage: '模型地址未配置，请联系开发者。',
        loading: false
      })
      return
    }

    this.setData({
      statusBarHeight: sysInfo.statusBarHeight || 0,
      badgeTitle: title,
      badgeId: badgeId,
      modelUrl: url,
      loading: true,
      error: false,
      showHint: true
    })

    // 隐藏操作提示
    setTimeout(() => {
      this.setData({ showHint: false })
    }, 3000)

    // xr-frame 加载完成事件不易捕获，延迟隐藏 loading
    setTimeout(() => {
      this.setData({ loading: false })
    }, 2500)
  },

  handleBack: function () {
    wx.navigateBack()
  },

  handleRetry: function () {
    this.setData({ error: false, loading: true })
    setTimeout(() => {
      this.setData({ loading: false })
    }, 2500)
  }
})

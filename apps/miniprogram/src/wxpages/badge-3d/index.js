var BADGE_MODEL_URLS = {
  visitor: 'https://atlas.bequer.cloud/visitor-badge.glb'
}

var BADGE_TITLES = {
  visitor: '入馆访客'
}

Page({
  data: {
    badgeId: '',
    badgeTitle: '',
    modelUrl: ''
  },

  onLoad: function (options) {
    var badgeId = options.badgeId || ''
    var title = BADGE_TITLES[badgeId] || '3D 徽章'
    var url = BADGE_MODEL_URLS[badgeId] || ''
    console.log('[badge-3d] onLoad badgeId=' + badgeId + ' url=' + url)
    this.setData({
      badgeId: badgeId,
      badgeTitle: title,
      modelUrl: url
    })
  },

  handleBack: function () {
    wx.navigateBack()
  }
})

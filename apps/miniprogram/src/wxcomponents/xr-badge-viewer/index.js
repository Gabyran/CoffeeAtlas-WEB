Component({
  properties: {
    modelUrl: {
      type: String,
      value: ''
    }
  },
  lifetimes: {
    attached() {
      console.log('[xr-badge-viewer] attached, model:', this.data.modelUrl)
    }
  }
})

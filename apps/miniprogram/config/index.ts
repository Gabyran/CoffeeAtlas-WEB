import path from 'node:path'
import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev.ts'
import prodConfig from './prod.ts'

const workspacePackageAliases = {
  '@coffee-atlas/shared-types': path.resolve(__dirname, '../../../packages/shared-types/dist/index.js'),
  '@coffee-atlas/api-client': path.resolve(__dirname, '../../../packages/api-client/dist/index.js'),
  '@coffee-atlas/domain': path.resolve(__dirname, '../../../packages/domain/dist/index.js')
}

export default defineConfig(async (merge) => {
  const baseConfig: UserConfigExport = {
    projectName: 'miniprogram',
    date: '2026-03-13',
    designWidth: 375,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      828: 1.81 / 2,
      375: 2 / 1
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [],
    defineConstants: {},
    copy: {
      patterns: [
        { from: 'src/wxcomponents', to: 'dist/wxcomponents' },
        { from: 'src/wxpages', to: 'dist/wxpages' },
      ],
      options: {}
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: {
        exclude: ['react', 'react-dom', '@tarojs/taro']
      }
    },
    alias: workspacePackageAliases,
    cache: {
      enable: false
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {}
        },
        url: {
          enable: true,
          config: {
            limit: 1024
          }
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)

        if (process.env.NODE_ENV === 'development') {
          chain.watchOptions({
            poll: 1000,
            aggregateTimeout: 300,
            ignored: /node_modules|dist|\.git/
          })
        }
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        autoprefixer: {
          enable: true,
          config: {}
        },
        cssModules: {
          enable: false,
          config: {
            namingPattern: 'module',
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, devConfig)
  }
  return merge({}, baseConfig, prodConfig)
})

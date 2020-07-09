/**
 * Adapted from angular2-webpack-starter
 */

const helpers = require('./config/helpers'),
  webpack = require('webpack');

/**
 * Webpack Plugins
 */
const ProvidePlugin = require('webpack/lib/ProvidePlugin');
const DefinePlugin = require('webpack/lib/DefinePlugin');
const LoaderOptionsPlugin = require('webpack/lib/LoaderOptionsPlugin');

module.exports = {
  devtool: 'inline-source-map',

  resolve: {
    extensions: ['.ts', '.js'],
    mainFields: [ 'es2015', 'browser', 'module', 'main']
  },

  entry: ['./vendor/mqtt.min.js', helpers.root('./src/index.ts')],

  output: {
    path: helpers.root('bundles'),
    publicPath: '/',
    filename: 'ngx-mqtt.min.js',
    libraryTarget: 'umd',
    library: 'ngx-mqtt'
  },

  // require those dependencies but don't bundle them
  externals: [
    /^\@angular\//, /^rxjs\//
  ],

  module: {
    rules: [{
      enforce: 'pre',
      test: /\.ts$/,
      loader: 'tslint-loader',
      exclude: [helpers.root('node_modules')]
    }, {
      test: /\.ts$/,
      loader: 'awesome-typescript-loader?declaration=false',
      exclude: [/\.e2e\.ts$/]
    }]
  },

  plugins: [
    // fix the warning in ./~/@angular/core/src/linker/system_js_ng_module_factory_loader.js
    new webpack.DefinePlugin({
      'process.env.NODE_ENV': JSON.stringify('development')
    }),
    new webpack.ContextReplacementPlugin(/angular(\\|\/)core(\\|\/)(esm(\\|\/)src|src)(\\|\/)linker/, helpers.root('./src')),
    new webpack.optimize.UglifyJsPlugin({
      compress: {
        warnings: false
      }
    }),
    new webpack.LoaderOptionsPlugin({
      options: {
        tslintLoader: {
          emitErrors: false,
          failOnHint: false
        }
      }
    })
  ]
};

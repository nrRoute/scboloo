const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const WebpackOnBuildPlugin = require('on-build-webpack')
const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const exec = require('child_process').execSync

const isProductionBuild = process.env.NODE_ENV === 'production'

let plugins = [
  new CopyWebpackPlugin([
    {from: './src/option/option.html', to: 'option/option.html'},
    {from: './src/popup/popup.html', to: 'popup/popup.html'},
    {from: './src/popup/popup.css', to: 'popup.css'},
    {from: './src/manifest.json'}
  ]),
  new WebpackOnBuildPlugin(() => {
    exec('cp -R dist/common/* dist/chrome')
    exec('cp -R dist/common/* dist/firefox')
    exec('cp -R dist/common/* dist/msedge')
  })
]

if (isProductionBuild) plugins.push(new UglifyJSPlugin())

module.exports = {
  devtool: isProductionBuild ? false : 'inline-source-map',
  entry: {
    main: ['./src/main.js'],
    content: ['./src/content.js'],
    option: ['./src/option/option.js'],
    popup: ['./src/popup/popup.js']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist/common')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /(node_modules)/,
        loader: 'babel-loader',
        query: {
          babelrc: false,
          presets: [['es2015', { 'modules': false }]]
        }
      }
    ]
  },
  plugins
}

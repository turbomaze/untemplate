var webpack = require('webpack');
var path = require('path');
var UglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
var env = process.env.WEBPACK_ENV;

var libraryName = 'untemplate';
var plugins = [];

plugins.push(new UglifyJsPlugin({ minimize: true }));

var config = {
  entry: {
    'lib/untemplate': path.join(__dirname, '/src/index.js'),
    'demo/demo': path.join(__dirname, '/demo/templaterDemo.js')
  },
  devtool: 'source-map',
  output: {
    path: __dirname,
    filename: '[name].min.js',
    library: 'untemplate',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    loaders: [
      {
        test: /(\.jsx|\.js)$/,
        loader: 'babel-loader',
        exclude: /(node_modules|bower_components)/
      }
    ]
  },
	plugins: plugins
};

module.exports = config;

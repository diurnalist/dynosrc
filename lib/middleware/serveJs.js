module.exports = function (req, res) {
  res.writeHead(200, {
    'content-type': 'application/x-javascript',
    'cache-control': 'public, max-age=2592000'
  });

  res.end(this.getClientLib(true));
};
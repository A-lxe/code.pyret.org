var Q = require("q");

function makeStorage(client) {
  function getUserByGoogleId(id) {
    return Q.ninvoke(client, "hgetall", [id]);
  }
  function updateRefreshToken(userId, refreshToken) {
    var curVal = getUserByGoogleId(userId);
    return Q.ninvoke(client, "hset", [userId, "refresh_token", refreshToken]);
  }
  function createUser(data) {
    console.log("Creating user: ", data);
    return Q.ninvoke(client, "hmset", [data.google_id, "google_id", data.google_id, "refresh_token", data.refresh_token]).then(function(_) { return getUserByGoogleId(data.google_id); });
  }
  return {
    getUserByGoogleId: getUserByGoogleId,
    updateRefreshToken: updateRefreshToken,
    createUser: createUser
  };
}

module.exports = { makeStorage: makeStorage }

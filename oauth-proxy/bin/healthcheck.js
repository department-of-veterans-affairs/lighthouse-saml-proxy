var http = require("http");

var options = {
  host: "localhost",
  port: "7100",
  path: "/oauth2/.well-known/openid-configuration",
  timeout: 2000,
};

var request = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  if (res.statusCode == 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on("error", function () {
  console.log("ERROR");
  process.exit(1);
});

request.end();

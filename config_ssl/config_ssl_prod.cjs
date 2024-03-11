const fs = require("fs");
const yaml = require("js-yaml")

try {
  //reading file
  const yamlFile = fs.readFileSync('.ebextensions/certs.config', 'utf8');
  const data = yaml.load(yamlFile);

  //updating SSL certificates
  data["files"]['/etc/pki/tls/certs/server.crt']["source"] = "https://edv-certificates.s3.ap-south-1.amazonaws.com/prod/vanilla_certificate.crt"
  data["files"]["/etc/pki/tls/certs/server.key"]["source"] = "https://edv-certificates.s3.ap-south-1.amazonaws.com/prod/vanilla_private.key"


  //write file
  const yamlContent = yaml.dump(data);
  fs.writeFileSync('.ebextensions/certs.config', yamlContent, 'utf8');

  console.log(data);
} catch (error) {
  console.error(error);
}
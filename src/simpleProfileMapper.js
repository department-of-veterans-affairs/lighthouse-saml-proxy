function SimpleProfileMapper (pu) {
  if(!(this instanceof SimpleProfileMapper)) {
    return new SimpleProfileMapper(pu);
  }
  this._pu = pu;
}

SimpleProfileMapper.prototype.getClaims = function() {
  var self = this;
  var claims = {};

  SimpleProfileMapper.prototype.metadata.forEach(function(entry) {
    if (entry.transformer) {
      claims[entry.id] = entry.transformer(self._pu['claims']);
    }
    else {
      claims[entry.id] = entry.multiValue ?
        self._pu['claims'][entry.id].split(',') :
        self._pu['claims'][entry.id];
    }
  });

  console.log(claims);
  return Object.keys(claims).length && claims;
};

SimpleProfileMapper.prototype.getNameIdentifier = function() {
  return {
    nameIdentifier:                  this._pu.userName,
    nameIdentifierFormat:            this._pu.nameIdFormat,
    nameIdentifierNameQualifier:     this._pu.nameIdNameQualifier,
    nameIdentifierSPNameQualifier:   this._pu.nameIdSPNameQualifier,
    nameIdentifierSPProvidedID:      this._pu.nameIdSPProvidedID
  };
};

module.exports = SimpleProfileMapper;

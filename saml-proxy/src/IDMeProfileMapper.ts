interface IClaimField {
  id: string;
  optional: boolean;
  displayName: string;
  description: string;
  multiValue: boolean;
  transformer?: (claim: any) => string;
};

interface IClaimDescriptions { [key: string]: IClaimField };

interface ISamlAssertions {
  claims: any
  userName: string,
  nameIdFormat: string;
  nameIdNameQualifier?: string;
  nameIdSPNameQualifier?: string;
  nameIdSPProvidedID?: string;
};

const commonConfiguration: IClaimDescriptions = {
  email: {
    id: "email",
    optional: false,
    displayName: 'E-Mail Address',
    description: 'The e-mail address of the user',
    multiValue: false
  },
  level_of_assurance: {
    id: "level_of_assurance",
    optional: false,
    displayName: 'Level of Assurance',
    description: 'Level of identify proofing available for the user',
    multiValue: false
  },
  multifactor: {
    id: "multifactor",
    optional: false,
    displayName: 'Multifactor',
    description: 'If the user has two factor auth enabled',
    multiValue: false
  },
  uuid: {
    id: "uuid",
    optional: false,
    displayName: 'uuid',
    description: 'IdP-generated UUID of the user',
    multiValue: false
  },
};

const idmeConfiguration: IClaimDescriptions  = {
  firstName: {
    id: "fname",
    optional: true,
    displayName: 'First Name',
    description: 'The given name of the user',
    multiValue: false
  },
  lastName: {
    id: "lname",
    optional: true,
    displayName: 'Last Name',
    description: 'The surname of the user',
    multiValue: false
  },
  middleName: {
    id: "mname",
    optional: true,
    displayName: 'Middle Name',
    description: 'The middle name of the user',
    multiValue: false
  },
  ssn: {
    id: "social",
    optional: true,
    displayName: 'SSN',
    description: 'The SSN of the user',
    multiValue: false
  },
  gender: {
    id: "gender",
    optional: true,
    displayName: 'Gender',
    description: 'The administrative gender of the user',
    multiValue: false
  },
  dateOfBirth: {
    id: "birth_date",
    optional: true,
    displayName: 'Birth Date',
    description: 'The birth date of the user',
    multiValue: false
  },
};

const dsLogonConfiguration: IClaimDescriptions = {
  dateOfBirth: {
    id: "dslogon_birth_date",
    optional: true,
    displayName: 'Birth Date',
    description: 'DSLogon-reported birth date of the user',
    multiValue: false
  },
  firstName: {
    id: "dslogon_fname",
    optional: true,
    displayName: 'First Name',
    description: 'DSLogon-reported first name of the user',
    multiValue: false
  },
  lastName: {
    id: "dslogon_lname",
    optional: true,
    displayName: 'Last Name',
    description: 'DSLogon-reported last name of the user',
    multiValue: false
  },
  middleName: {
    id: "dslogon_mname",
    optional: true,
    displayName: 'Middle Name',
    description: 'DSLogon-reported middle name of the user',
    multiValue: false
  },
  gender: {
    id: "dslogon_gender",
    optional: true,
    displayName: 'Gender',
    description: 'DSLogon-reported administrative gender of the user',
    multiValue: false
  },
  // TODO: Make sure this is always an SSN
  ssn: {
    id: "dslogon_idvalue",
    optional: true,
    displayName: 'ID Value',
    description: 'DSLogon-reported SSN of the user',
    multiValue: false
  },
  dslogon_assurance: {
    id: "dslogon_assurance",
    optional: true,
    displayName: 'Level of assurance',
    description: 'DSLogon-reported level of assurance',
    multiValue: false
  },
  edipi: {
    id: "dslogon_uuid",
    optional: true,
    displayName: 'DS Logon UUID',
    description: 'DSLogon-reported UUID aka EDIPI',
    multiValue: false
  },
};

const mhvConfiguration: IClaimDescriptions = {
  mhv_uuid: {
    id: "mhv_uuid",
    optional: true,
    displayName: 'MHV UUID',
    description: 'MHV-reported UUID',
    multiValue: false
  },
  profile: {
    id: "mhv_profile",
    optional: true,
    displayName: 'MHV user profile',
    description: 'MHV user profile, includes account status',
    multiValue: false
  },
  icn: {
    id: "mhv_icn",
    optional: true,
    displayName: 'MHV ICN',
    description: 'MHV-reported ICN',
    multiValue: false
  },
  accountType: {
    id: "mhv_account_type",
    optional: true,
    displayName: 'MHV account type',
    description: 'MHV account type',
    multiValue: false,
    transformer: (claims: { mhv_profile?: string }) => {
      if (claims && claims.mhv_profile) {
        return JSON.parse(claims.mhv_profile).accountType;
      }
      return undefined;
    }
  }
}

export class IDMeProfileMapper {
  samlAssertions: ISamlAssertions;

  constructor(assertions: ISamlAssertions) {
    this.samlAssertions = assertions;
  }

  public getClaims() {
    let claims = this.getClaimFields(commonConfiguration, {});
    if (this.samlAssertions.claims.mhv_uuid) {
      claims = this.getClaimFields(mhvConfiguration, claims);
    } else if (this.samlAssertions.claims.dslogon_edipi) {
      claims = this.getClaimFields(dsLogonConfiguration, claims);
    } else {
      claims = this.getClaimFields(idmeConfiguration, claims);
    }
    return claims;
  }

  public getNameIdentifier() {
    return {
      nameIdentifier:                  this.samlAssertions.userName,
      nameIdentifierFormat:            this.samlAssertions.nameIdFormat,
      nameIdentifierNameQualifier:     this.samlAssertions.nameIdNameQualifier,
      nameIdentifierSPNameQualifier:   this.samlAssertions.nameIdSPNameQualifier,
      nameIdentifierSPProvidedID:      this.samlAssertions.nameIdSPProvidedID
    };
  }

  private getClaimFields(fields: IClaimDescriptions, claims: { [key: string]: string | undefined }) {
    return Object.keys(fields).reduce((_claims, claimKey) => {
      const { id, multiValue, ...claimField } = fields[claimKey];
      if (claimField.transformer) {
        _claims[claimKey] = claimField.transformer(this.samlAssertions.claims[id]);
      } else {
        _claims[claimKey] = multiValue ?
          this.samlAssertions.claims[id].split(',') :
          this.samlAssertions.claims[id];
      }
      return _claims;
    }, claims);
  }
}

export const createProfileMapper = (assertions: ISamlAssertions) => {
  return new IDMeProfileMapper(assertions);
}

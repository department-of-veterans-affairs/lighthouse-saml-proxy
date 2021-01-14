const access_token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjoiZW1haWwucmVhZCIsImlhdCI6MTUxNjIzOTAyMn0.iiq38iOU_UJSl3emfEc8fSelVl7dWBaZ-Yd5wurVhc4";
const access_token_patient =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjoibGF1bmNoL3BhdGllbnQiLCJpYXQiOjE1MTYyMzkwMjJ9.5RLmIUn-kZqZVb4IqxNUpWCXPYtDrBraShDHTIndlgU";

const buildGetTokenStrategy = (response, error = false) => {
  const getTokenStrategy = { getToken: jest.fn() };
  getTokenStrategy.getToken.mockImplementation(() => {
    return new Promise((resolve, reject) => {
      if (!error) {
        resolve(response);
      } else {
        reject(response);
      }
    });
  });
  return getTokenStrategy;
};

const buildGetDocumentStrategy = (document) => {
  const getDocumentStrategy = { getDocument: jest.fn() };
  getDocumentStrategy.getDocument.mockImplementation(() => {
    return new Promise((resolve) => {
      resolve(document);
    });
  });
  return getDocumentStrategy;
};

const buildSaveDocumentStrategy = () => {
  const saveDocumentStrategy = { saveDocumentToDynamo: jest.fn() };
  saveDocumentStrategy.saveDocumentToDynamo.mockImplementation(() => {
    return new Promise((resolve) => {
      resolve();
    });
  });
  return saveDocumentStrategy;
};

const buildGetPatientInfoStrategy = (patient, error) => {
  const getPatientInfoStrategy = { createPatientInfo: jest.fn() };
  getPatientInfoStrategy.createPatientInfo.mockImplementation(() => {
    return new Promise((resolve, reject) => {
      if (!error) {
        resolve(patient);
      } else {
        reject(patient);
      }
    });
  });
  return getPatientInfoStrategy;
};

const buildToken = (is_static, patient) => {
  let token = {
    is_static: is_static,
    access_token: patient ? access_token_patient : access_token,
  };

  return token;
};

const buildValidateToken = (response, error) => {
  const mockValidate = jest.fn();
  mockValidate.mockImplementation(() => {
    return new Promise((resolve, reject) => {
      if (!error) {
        resolve(response);
      } else {
        reject(response);
      }
    });
  });
  return mockValidate;
};

module.exports = {
  buildGetTokenStrategy,
  buildGetDocumentStrategy,
  buildSaveDocumentStrategy,
  buildGetPatientInfoStrategy,
  buildToken,
  buildValidateToken,
};

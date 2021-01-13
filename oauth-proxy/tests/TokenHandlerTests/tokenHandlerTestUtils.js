const access_token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjoiZW1haWwucmVhZCIsImlhdCI6MTUxNjIzOTAyMn0.iiq38iOU_UJSl3emfEc8fSelVl7dWBaZ-Yd5wurVhc4";
const access_token_patient =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjoibGF1bmNoL3BhdGllbnQiLCJpYXQiOjE1MTYyMzkwMjJ9.5RLmIUn-kZqZVb4IqxNUpWCXPYtDrBraShDHTIndlgU";

const buildGetTokenResponseStrategy = (response, error = false) => {
  const getTokenResponseStrategy = { getTokenResponse: jest.fn() };
  getTokenResponseStrategy.getTokenResponse.mockImplementation(() => {
    return new Promise((resolve, reject) => {
      if (!error) {
        resolve(response);
      } else {
        reject(response);
      }
    });
  });
  return getTokenResponseStrategy;
};

const buildGetDocumentStrategy = (document) => {
  const getDocumentStrategy = { pullDocumentFromDynamo: jest.fn() };
  getDocumentStrategy.pullDocumentFromDynamo.mockImplementation(() => {
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

module.exports = {
  buildGetTokenResponseStrategy,
  buildGetDocumentStrategy,
  buildSaveDocumentStrategy,
  buildGetPatientInfoStrategy,
  buildToken,
};

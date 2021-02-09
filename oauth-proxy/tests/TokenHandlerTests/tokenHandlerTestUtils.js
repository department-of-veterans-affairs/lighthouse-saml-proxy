const access_token =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjpbImVtYWlsLnJlYWQiXSwiaWF0IjoxNTE2MjM5MDIyfQ.lybRIPdhq6UslRqKRtiEuyqnCUY6OoDFeXRaogoPROk";
const access_token_patient =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjpbImxhdW5jaC9wYXRpZW50Il0sImlhdCI6MTUxNjIzOTAyMn0.2PU4pZHbSRhOgpmG9jfCgY0YEoq5hmq9LH_56e6VfzA";
const access_token_launch =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwic2NwIjpbImxhdW5jaCJdLCJpYXQiOjE1MTYyMzkwMjJ9.61N3OfyoslutHtsG1PxVWztr77PyMiVz9Js4CwzPiV8";
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

const buildToken = (is_static, patient, standaloneLaunch) => {
  let token = {
    is_static: is_static,
    access_token: patient
      ? standaloneLaunch
        ? access_token_patient
        : access_token_launch
      : access_token,
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

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

const buildGetPatientInfoStrategy = (patient, error = false) => {
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

module.exports = {
  buildGetTokenResponseStrategy,
  buildGetDocumentStrategy,
  buildSaveDocumentStrategy,
  buildGetPatientInfoStrategy,
};

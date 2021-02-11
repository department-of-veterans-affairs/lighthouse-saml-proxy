const manageHandler = (res, next, manageEndpoint) => {
  if(!manageEndpoint) {
    throw {
      statusCode: 404,
      error: "NOT FOUND",
      error_description: "No manage url defined for this endpoint.",
    }
  }
  res.redirect(manageEndpoint);
  next();
}

module.exports = manageHandler;
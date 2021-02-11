const manageHandler = async (res, next, manageEndpoint) => {
  if (!manageEndpoint) {
    res.status(404).json({
      error: "NOT FOUND",
      error_description: "No manage url defined for this endpoint.",
    });
    return next();
  }
  res.redirect(manageEndpoint);
  next();
};

module.exports = manageHandler;

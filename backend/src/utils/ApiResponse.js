class ApiResponse {
  constructor(statusCode, message, data = null) {
    this.success = statusCode < 400;
    this.statusCode = statusCode;
    this.message = message;
    if (data !== null) this.data = data;
  }

  send(res) {
    return res.status(this.statusCode).json(this);
  }
}

module.exports = ApiResponse;

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true, // required so the browser sends/receives the refresh-token cookie
  })
);

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ / . operators from body, query, params

app.use(
  morgan(env.nodeEnv === 'production' ? 'combined' : 'dev', {
    stream: logger.stream,
  })
);

app.get('/health', (_req, res) => {
  res.json({ success: true, message: 'LawGPT API is running', env: env.nodeEnv });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;

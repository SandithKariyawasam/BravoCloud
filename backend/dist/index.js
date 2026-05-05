"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_session_1 = __importDefault(require("express-session"));
const passport_1 = __importDefault(require("passport"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const github_1 = __importDefault(require("./routes/github"));
const projects_1 = __importDefault(require("./routes/projects"));
const deployments_1 = __importDefault(require("./routes/deployments"));
const firebase_1 = require("./lib/firebase");
const FirebaseStore = require('connect-session-firebase')(express_session_1.default);
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express_1.default.json());
app.set('trust proxy', 1);
app.use((0, express_session_1.default)({
    store: new FirebaseStore({
        database: firebase_1.db
    }),
    secret: process.env.SESSION_SECRET || 'bravocloud_super_secret',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: true, // Required for cross-origin cookies on Vercel
        sameSite: 'none', // Required for cross-origin cookies
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use('/auth', auth_1.default);
app.use('/api/github', github_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/deployments', deployments_1.default);
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to BravoCloud API', status: 'running' });
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`BravoCloud Backend running on http://localhost:${PORT}`);
    });
}
exports.default = app;

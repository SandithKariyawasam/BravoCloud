"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const dotenv_1 = __importDefault(require("dotenv"));
const auth_1 = __importDefault(require("./routes/auth"));
const github_1 = __importDefault(require("./routes/github"));
const projects_1 = __importDefault(require("./routes/projects"));
const deployments_1 = __importDefault(require("./routes/deployments"));
const analytics_1 = __importDefault(require("./routes/analytics"));
const speedInsights_1 = __importDefault(require("./routes/speedInsights"));
const usage_1 = __importDefault(require("./routes/usage"));
const user_1 = __importDefault(require("./routes/user"));
const support_1 = __importDefault(require("./routes/support"));
const chat_1 = __importDefault(require("./routes/chat"));
const path_1 = __importDefault(require("path"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
}));
app.use(express_1.default.json());
app.set('trust proxy', 1);
app.use(passport_1.default.initialize());
app.use('/auth', auth_1.default);
app.use('/api/github', github_1.default);
app.use('/api/projects', projects_1.default);
app.use('/api/deployments', deployments_1.default);
app.use('/api/analytics', analytics_1.default);
app.use('/api/speed-insights', speedInsights_1.default);
app.use('/api/usage', usage_1.default);
app.use('/api/user', user_1.default);
app.use('/api/support', support_1.default);
app.use('/api/chat', chat_1.default);
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to BravoCloud API', status: 'running' });
});
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});
// Admin chat dashboard
app.get('/admin/chat', (req, res) => {
    res.sendFile(path_1.default.join(__dirname, 'admin', 'index.html'));
});
// Global error handler for debugging
app.use((err, req, res, next) => {
    console.error('Fatal Error:', err);
    res.status(500).json({
        error: 'Internal Server Error',
        message: err.message || String(err),
        oauth_details: err.oauthError ? err.oauthError.data : null,
        stack: process.env.NODE_ENV === 'production' ? 'hidden' : err.stack
    });
});
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`BravoCloud Backend running on http://localhost:${PORT}`);
    });
}
exports.default = app;

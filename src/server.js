const app = require('./app');
const config = require('./config');
const connectDB = require('./config/database');

const startServer = async () => {
    try {
        // Connect to database
        await connectDB();
        // Start the server
        const server = app.listen(config.port, () => {
            console.log(`Server is running on port ${config.port}`);
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (err) => {
            console.log('UNHANDLED REJECTION! 💥 Shutting down...');
            console.log(err.name, err.message);
            server.close(() => {
                process.exit(1);
            });
        });

    } catch (error) {
        console.error('Error starting server:', error);
        process.exit(1);
    }
};
startServer(); 
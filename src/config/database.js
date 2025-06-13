const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
    try {
        console.log("config.databaseURL ---" , config.databaseURL);
        
        const conn = await mongoose.connect(config.databaseURL, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB; 
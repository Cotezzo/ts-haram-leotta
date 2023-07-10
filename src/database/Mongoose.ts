import { ClassLogger } from "../classes/Logger";
import mongoose from "mongoose";    // MongoDB Database connector

const mongoUrl = process.env.ENVIROMENT == "P" ? process.env.PROD_DB : process.env.TEST_DB;
mongoose.set("strictQuery", false);
mongoose.connect(mongoUrl,
    {   // Connection options
        // useUnifiedTopology: true,
        // useNewUrlParser: true,
        // useCreateIndex: true,
        // useFindAndModify: false
    }, (e) => new ClassLogger("Mongoose").info(e ? ("Error during connection to " + mongoUrl + ": " + e) : "Database successfully started and connected to " + mongoUrl));

export { mongoose };
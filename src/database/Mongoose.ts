import { ClassLogger } from "../classes/Logger";
import mongoose from "mongoose";												// MongoDB Database connector

mongoose.connect(process.env.ENVIROMENT == "P" ? process.env.PROD_DB : process.env.TEST_DB,
    {   // Connection options
        // useUnifiedTopology: true,
        // useNewUrlParser: true,
        // useCreateIndex: true,
        // useFindAndModify: false
    }, () => new ClassLogger("Mongoose").info("Database successfully started and connected."));

export { mongoose };
import re
import struct
from flask import Flask, request

app = Flask(__name__)

HEART_RATE_FILE_PATTERN = r'^trial\_hr'
IMU_FILE_PATTERN        = r'^trial\_(acc|gyro)'
IMU_AXIS_NAMES          = ["x", "y", "z"]
        

@app.get("/fitbit-ping/")
def fitbit_ping():
    return "FITBIT_HOST", 200


@app.post("/fitbit-endpoint/")
def fitbit_endpoint():
    
    try:
        nbytes     = int(request.headers["Content-length"])
        filename   = request.headers["Fitbit-filename"]
        
    # Some of header is missing, request ill formed
    except KeyError as e:
        print(e)
        return "Missing headers", 400

    # Store heart rate samples in the given filename, each byte is a heart rate sample
    if re.search(HEART_RATE_FILE_PATTERN, filename) is not None:
        try:
            heart_rate_samples = request.stream.read(nbytes)
            with open(filename, "w") as heart_rate_file:
                heart_rate_file.write(",".join([str(sample) for sample in heart_rate_samples]))
        
        # Unexpected error when storing heart rate samples:
        except Exception as e:
            print("Unexpected error when storing heart rate samples:", e)
            return repr(e), 500
            
    # Store accelerometer or gyroscope samples. According to Accelerometer and Gyroscope API
    # documentation:
    # https://dev.fitbit.com/build/reference/device-api/gyroscope/#interface-batchedgyroscopereading
    # https://dev.fitbit.com/build/reference/device-api/accelerometer/#interface-batchedaccelerometerreading
    #
    # samples of these sensors are stored in Float32Arrays, hence 4 bytes per sample are needed to decode
    # the values of the samples:
    elif re.search(IMU_FILE_PATTERN, filename) is not None:
        
        try:
            batch_size = int(request.headers["Fitbit-batch-size"])
            
        except KeyError as e:
            return "Missing batch_size header", 400
        
        # Samples come without format. Readings are written one after the other in binary file
        # that must be decoded. A number of samples equal to the 'batch_size' variable is written
        # for an axis, then, the same number of samples is written for the next axis, and so on.
        
        # Define expected binary format of the samples of each axis to decode the float32 values
        # (https://docs.python.org/3/library/struct.html#format-characters):
        axis_values_binary_format = "<%sf" % batch_size
        samples_per_line          = len(IMU_AXIS_NAMES)*batch_size

        if nbytes % samples_per_line != 0:
            return "Number of bytes received does not correspond with the number of axis and batch size.", 400

        with open(filename, "w") as imu_file:
            
            # Column names of the CSV file:
            imu_file.write(",".join(IMU_AXIS_NAMES) + "\n")
            
            # Iterate in the total number of batches present in the received file:
            for _ in range(int(nbytes / samples_per_line)):
                
                # Read  'batch_size' samples for every axis
                batch_values = [request.stream.read(batch_size*4) for _ in IMU_AXIS_NAMES] # 4 is the number of bytes needed to write a float value
                
                if len(batch_values[0]) == 0:
                    continue
            
                batch_values = [struct.unpack(axis_values_binary_format, axis_batch_values) for axis_batch_values in batch_values]

                # Reorganize read data so that 1 sample of each axis is read in each iteration
                for line in zip(*batch_values):
                    imu_file.write(",".join([str(value) for value in line]) + "\n")
                    
                
    # God knows what type of file is this:
    else:
        return "Unknown file type", 400

    return "OK", 200
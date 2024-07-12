import re
import math
import struct
import time
import threading
import pandas as pd
from flask import Flask, request

app = Flask(__name__)

HEART_RATE_FILE_PATTERN = r'^trial\_hr'
IMU_FILE_PATTERN        = r'^trial\_(acc|gyro)'
IMU_AXIS_NAMES          = ["x", "y", "z"]
        
received_files = {}


def process_completed_file(filename):
    df = pd.read_csv(filename, sep=",", header=None, names=["timestamp", *IMU_AXIS_NAMES])
    df.drop_duplicates("timestamp")
    df.sort_values("timestamp")
    df.to_csv(filename, sep=",", index=False)

@app.get("/fitbit-ping/")
def fitbit_ping():
    return "FITBIT_HOST", 200


@app.post("/fitbit-endpoint/")
def fitbit_endpoint():
    # TODO: Get batch size and delta timestamp from request or the file where is
    # defined, but don't define it hard-coded like this.
    batch_size      = 100
    delta_timestamp = 10
    timestamp_size  = len(str(int(time.time() * 1000)))
    
    # Read batch info:
    # - batch index: 2 bytes (unsigned short integer)
    # - batch count: 2 bytes (unsigned short integer)
    # - x axis samples: 200 bytes (100 samples * 2 bytes per sample)
    # - y axis samples: 200 bytes (100 samples * 2 bytes per sample)
    # - z axis samples: 200 bytes (100 samples * 2 bytes per sample)
    # - initial timestamp for the batch: probably 26 bytes (13 characters to express timestamp and 2 bytes per character)
    # - filename where to store the values: don't know but sort of 80 bytes, this is read at the end because the size
    # currently can not be predicted
    
    # Read batch index and batch count
    batch_index, batch_count = struct.unpack("<2H", request.stream.read(4))
    
    # Read axis
    batch_samples = [request.stream.read(batch_size*2) for _ in IMU_AXIS_NAMES]
    
    # Read the rest of the information
    batch_initial_timestamp  = request.stream.read(timestamp_size*2).decode().replace("\x00", "")
    batch_initial_timestamp  = int(batch_initial_timestamp)
    filename                 = request.stream.read().decode().replace("\x00", "")

    # First batch for this filename, initialize the file in the dictionary we use to check which
    # batches of which files have already been received:
    if filename not in received_files.keys():
        received_files[filename] = [False] * batch_count
        
    # Batch already received for this file:
    elif received_files[filename][batch_index]:
        return "Testing", 500
    
    # Compute timestamp and write rows in file
    batch_samples = [[sample/100 for sample in struct.unpack("<%sh" % batch_size, axis_batch)] for axis_batch in batch_samples]
    batch_samples = zip(*batch_samples)
    
    with open(filename, "a") as imufile:
        for index, samples in enumerate(batch_samples):
            line = [batch_initial_timestamp + (delta_timestamp * index), *samples]
            line = ",".join(str(item) for item in line) + "\n"
            
            imufile.write(line)
            
    received_files[filename][batch_index] = True
    
    # Check if file is completely written
    if all(received_files[filename]):
        # Use thread to prevent blocking the response to the Fitbit device (and potentially starting
        # to send the file again)
        print("Completed file!!!!!", filename)
        threading.Thread(target=process_completed_file, args=[filename]).start()
        return "COMPLETED_FILE-%s" % filename, 200
    
        # If so, delete duplicates, order columns by timestamp and send response to smartwatch to delete the file
    
    return "OK", 200

     # Store accelerometer or gyroscope samples. According to Accelerometer and Gyroscope API
    # documentation:
    # https://dev.fitbit.com/build/reference/device-api/gyroscope/#interface-batchedgyroscopereading
    # https://dev.fitbit.com/build/reference/device-api/accelerometer/#interface-batchedaccelerometerreading
    #
    # samples of these sensors are stored in Float32Arrays, hence 4 bytes per sample are needed to decode
    # the values of the samples:
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
    
    elif re.search(IMU_FILE_PATTERN, filename) is not None:
        print("incoming IMU file", filename)
        try:
            batch_size = int(request.headers["Fitbit-batch-size"])
            print("read batch size from header %s" % batch_size)
            
        except KeyError as e:
            return "Missing batch_size header", 400
        
        # Samples come without format. Readings are written one after the other in binary file
        # that must be decoded. A number of samples equal to the 'batch_size' variable is written
        # for an axis, then, the same number of samples is written for the next axis, and so on.
        
        # Define expected binary format of the samples of each axis to decode the float32 values
        # (https://docs.python.org/3/library/struct.html#format-characters):
        axis_values_binary_format = "<%sf" % batch_size
        samples_per_line          = len(IMU_AXIS_NAMES)*batch_size
        bytes_per_batch           = batch_size*4
        bytes_per_line            = samples_per_line*4 # 4 bytes per sample
        read_nbytes               = 0
        
        if nbytes % bytes_per_line != 0:
            return "Size of the file (%s) does not match batch size (bytes per line %s)" % (nbytes, bytes_per_line), 400
        
        with open(filename, "w") as imu_file:
            
            # Column names of the CSV file:
            imu_file.write(",".join(IMU_AXIS_NAMES) + "\n")
            
            # Iterate in the total number of batches present in the received file:
            for _ in range(int(nbytes / samples_per_line)):
            # for _ in range(math.floor(nbytes / samples_per_line)):
                
                # Read  'batch_size' samples for every axis
                batch_values = [request.stream.read(batch_size*4) for _ in IMU_AXIS_NAMES] # 4 is the number of bytes needed to write a float value
                
                if len(batch_values[0]) == 0:
                    continue
                    
                values = []
                for axis_batch_values in batch_values:
                    try:
                        values += [struct.unpack(axis_values_binary_format, axis_batch_values)]
                        read_nbytes += bytes_per_batch
                        
                    except Exception as e:
                        print("Could not unpack batch values", e)
            
                # batch_values = [struct.unpack(axis_values_binary_format, axis_batch_values) for axis_batch_values in batch_values]
                # read_nbytes += bytes_per_line

                # Reorganize read data so that 1 sample of each axis is read in each iteration
                for line in zip(*batch_values):
                    imu_file.write(",".join([str(value) for value in line]) + "\n")
           
        unread_nbytes = nbytes - read_nbytes         
        if unread_nbytes != 0:
            print("Unread bytes in file:", unread_nbytes)
            
        return "Could not save file", 500
                    
           
    # God knows what type of file is this:
    else:
        return "Unknown file type", 400

    return "OK", 200
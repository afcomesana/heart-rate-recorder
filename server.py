import re
import struct
from collections import namedtuple
from http.server import HTTPServer, BaseHTTPRequestHandler

HttpResponse = namedtuple("HttpResponse", ["code", "message"])

HEART_RATE_FILE_PATTERN = r'^trial\_hr'
IMU_FILE_PATTERN        = r'^trial\_(acc|gyro)'
IMU_AXIS_NAMES          = ["x", "y", "z"]

class HttpRequestHandler(BaseHTTPRequestHandler):
    """
    Process incoming requests.

    Args:
        BaseHTTPRequestHandler (class): Most basic handler class whose functions must be extended
        to properly request the different types of requests.
    """
    
    def send_http_response(self, http_response):
        """
        Send HTTP response with the given code and message.
        
        Args:
            http_response (HttpResponse): Instance of the HttpResponse namedtuple class initialized with
            a proper code and message.
        """
        
        # Set response code
        self.send_response(http_response.code)
        self.end_headers()
        
        # Send response message
        self.wfile.write(http_response.message.encode("utf-8"))
    
    
    def do_GET(self):
        """
        Override do_GET method of the BaseHTTPRequestHandler class to process GET requests.
        
        Answer the PING from the Fitbit device so that it can send to this server address the heart rate data.
        """
        
        # Ensure correct path of the request
        if re.search(r'fitbit\-ping\/?$', self.path) is None:
            return

        self.send_http_response(HttpResponse(200, "FITBIT_HOST"))
        
        
    def do_POST(self):
        """
        Override do_POST method of the BaseHTTPRequestHandler class to process POST requests.
        
        Store the heart rate data sent by the Fitbit device when it is sent properly:
        - Correct path (/fitbit-endpoint/)
        - Correct headers:
        - - Content-length: number of bytes, namely heart rate samples, present in the file
        - - X_FITBIT_FILENAME: name of the file that will store the heart rate samples
        - - X_FITBIT_BATCH_SIZE: number of samples consecutively read in smartwatch
        """
        
        # Ensure correct path of the request
        if re.search(r'fitbit\-endpoint\/?$', self.path) is None:
            return
        
        # Get from the request the number of heart rate samples and the filename to store them  
        try:
            nbytes     = int(self.headers["Content-length"])
            filename   = self.headers["X_FITBIT_FILENAME"]
            
        # Some of header is missing, request ill formed
        except KeyError as e:
            self.send_http_response(HttpResponse(400, "Bad request"))
            return
        
        # Store the heart rate samples in the given filename, each byte is a heart rate sample
        if re.search(HEART_RATE_FILE_PATTERN, filename) is not None:
            try:
                heart_rate_samples = self.rfile.read(nbytes)
                with open(filename, "w") as fitbit_file:
                    fitbit_file.write(",".join([str(sample) for sample in heart_rate_samples]))
            
            # Unexpected error when storing heart rate samples:
            except Exception as e:
                print("Unexpected error when storing heart rate samples:", e)
                self.send_http_response(HttpResponse(500, "Server error"))
                return
                
        # Store accelerometer or gyroscope samples. According to Accelerometer and Gyroscope API
        # documentation:
        # https://dev.fitbit.com/build/reference/device-api/gyroscope/#interface-batchedgyroscopereading
        # https://dev.fitbit.com/build/reference/device-api/accelerometer/#interface-batchedaccelerometerreading
        #
        # samples of these sensors are stored in Float32Arrays, hence 4 bytes per sample are needed to decode
        # the values of the samples:
        elif re.search(IMU_FILE_PATTERN, filename) is not None:
            
            try:
                batch_size = int(self.headers["X_FITBIT_BATCH_SIZE"])
                
            except KeyError as e:
                self.send_http_response(HttpResponse(400, "Bad request"))
                return
            
            # Samples come without format. Readings are written one after the other in binary file
            # that must be decoded. A number of samples equal to the 'batch_size' variable is written
            # for an axis, then, the same number of samples is written for the next axis, and so on.
            
            # Define expected binary format of the samples of each axis to decode the float32 values
            # (https://docs.python.org/3/library/struct.html#format-characters):
            axis_values_binary_format = "<%sf" % batch_size
            samples_per_line          = len(IMU_AXIS_NAMES)*batch_size

            if nbytes % samples_per_line != 0:
                print("Number of bytes received does not correspond with the number of axis and batch size.")
                return

            if filename == "trial_acc_2024-6-20_16-24-44":
                print(filename, "size", nbytes)

            with open(filename, "w") as fitbit_file:
                
                # Column names of the CSV file:
                fitbit_file.write(",".join(IMU_AXIS_NAMES) + "\n")
                
                # Iterate in the total number of batches present in the received file:
                for _ in range(int(nbytes / samples_per_line)):
                    
                    # Read 'batch_size' samples for every axis
                    batch_values = self.rfile.read(batch_size*4)

                    if filename == "trial_acc_2024-6-20_16-24-44":
                        print(batch_values)
                    
                    axis_batch_values = [struct.unpack(axis_values_binary_format, batch_values) for _ in IMU_AXIS_NAMES]
                    
                    # Reorganize read data so that 1 sample of each axis is read in each iteration
                    for line in zip(*axis_batch_values):
                        fitbit_file.write(",".join([str(value) for value in line]) + "\n")
        
        # God knows what type of file is this:
        else:
            self.send_http_response(HttpResponse(400, "Bad request"))
            return
        
        self.send_http_response(HttpResponse(200, "OK"))
        

def start_server(server_class=HTTPServer, handler_class=HttpRequestHandler):
    """
    Start a HTTP server to communicate with the Fitbit device.

    Args:
        server_class (class, optional): The type of server to initialize. Defaults to HTTPServer.
        handler_class (class, optional): Class with the functions that will handle the requests. Defaults to HttpRequestHandler.
        
    Check https://docs.python.org/es/3/library/http.server.html for more information on the type of servers and request handlers available.
    """
    
    server_address = ('', 12345) # empty IP to listen on all network interfaces
    httpd = server_class(server_address, handler_class)
    httpd.serve_forever()
    
if __name__ == "__main__":
    start_server()
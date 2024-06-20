import re
from collections import namedtuple
from http.server import HTTPServer, BaseHTTPRequestHandler

HttpResponse = namedtuple("HttpResponse", ["code", "message"])

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
        """
        
        # Ensure correct path of the request
        if re.search(r'fitbit\-endpoint\/?$', self.path) is None:
            return
        
        # Get from the request the number of heart rate samples and the filename to store them  
        try:
            nbytes = int(self.headers["Content-length"])
            filename = self.headers["X_FITBIT_FILENAME"]
            
        # Some of header is missing, request ill formed
        except KeyError as e:
            self.send_http_response(HttpResponse(400, "Bad request"))
            return
        
        # Store the heart rate samples in the given filename, each byte is a heart rate sample
        try:
            # if re.search(r'^trial_hr', filename) is not None:
            heart_rate_samples = self.rfile.read(nbytes)
            with open(filename, "w") as fitbit_file:
                fitbit_file.write(",".join([str(sample) for sample in heart_rate_samples]))
                    
            # else:
            #     imu_samples = self.rfile.read(nbytes)
                
            #     with open(filename, "w") as fitbit_file:
            #         for line in range(nbytes/90):
                        
            
            self.send_http_response(HttpResponse(200, "OK"))
            
        # Unexpected error when storing heart rate samples:
        except Exception as e:
            print("Unexpected error when storing heart rate samples:", e)
            self.send_http_response(HttpResponse(500, "Server error"))


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
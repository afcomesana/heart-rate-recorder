// Files in the "common" directory are accessible from both companion (phone) and smartwatch (app)

export const APP_DIRECTORY     = "/private/data/";
export const SAMPLE_FREQUENCY  = 100;
export const SAMPLES_PER_BATCH = 100;
export const BYTES_PER_SAMPLE  = 4;
export const BYTES_PER_BATCH   = SAMPLES_PER_BATCH*BYTES_PER_SAMPLE;
export const AXIS_NAMES        = ["x", "y", "z"];

// Settings properties names
export const FILES_LIST_SETTINGS_NAME             = "filesList";
export const ASK_FOR_SINGLE_FILE_SETTINGS_NAME    = "singleFileToAskFor";
export const DELETE_SINGLE_FILE_SETTINGS_NAME     = "singleFileToDelete";
export const BATCH_INDEX_SETTINGS_NAME            = "batchIndex";
export const BATCH_COUNT_SETTINGS_NAME            = "batchCount";
export const FILE_BEING_TRANSFERRED_SETTINGS_NAME = "fileBeingTransferred";
export const FILE_TRANSFER_QUEUE_SETTINGS_NAME    = "fileTransferQueue";
export const IS_RECORDING_SETTINGS_NAME           = "isRecording";
export const RECORD_COMMAND_SETTINGS_NAME         = "recordCommand";
export const HOST_IP_SETTINGS_NAME                = "hostIp";

// Actions' names of the commands between phone and smartwatch
export const SEND_FILE_ACTION_NAME           = "sendFile";
export const DELETE_FILE_ACTION_NAME         = "deleteFile";
export const FILE_DELETED_ACTION_NAME        = "deletedFile";
export const ALL_FILES_ACTION_NAME           = "allFilesAction";
export const LIST_FILES_ACTION_NAME          = "listFiles";
export const FILE_LISTED_ACTION_NAME         = "listedFile";
export const FILE_LIST_COMPLETED_ACTION_NAME = "fileListCompleted";

// Actions' values of the commands between phone and smartwatch:
export const ALL_FILES_ACTION_SEND_VALUE   = "SEND";
export const ALL_FILES_ACTION_DELETE_VALUE = "DELETE";
export const ALL_FILES_ACTION_RELOAD_VALUE = "RELOAD";
export const DELETE_ALL_FILES_ACTION_VALUE = "ALL";
export const START_RECORD_ACTION_VALUE     = "START";
export const STOP_RECORD_ACTION_VALUE      = "STOP";
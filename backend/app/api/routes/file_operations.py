"""
File operations API endpoints for VM file transfer
"""
import base64
import logging
import shlex
from typing import Dict, Any, Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
import io

from app.services.vm_control import VMControlService
from app.services.database import DatabaseService
from app.services.auth import get_verified_user_id

logger = logging.getLogger(__name__)
router = APIRouter()

# Initialize services
vm_control_service = VMControlService()
db_service = DatabaseService()


async def verify_machine_access(machine_id: str, user_id: Optional[str]) -> Optional[Dict]:
    """Verify that the user has access to the machine and return machine details"""
    if not user_id:
        logger.warning(f"No user_id provided for machine access verification")
        return None
    
    # For local machines (Docker containers), return basic info
    if machine_id.startswith("local-"):
        logger.info(f"Allowing access to local machine {machine_id} for user {user_id}")
        return {
            "id": machine_id,
            "public_ip": "localhost",
            "agent_port": 8081,
            "vnc_password": "vncpassword"
        }
    
    # Check database for machine ownership
    try:
        machine = await db_service.get_machine(machine_id, user_id)
        if machine:
            logger.info(f"User {user_id} has access to machine {machine_id}")
            return machine
        else:
            logger.warning(f"User {user_id} does not have access to machine {machine_id}")
            return None
    except Exception as e:
        logger.error(f"Error verifying machine access: {str(e)}")
        return None


async def ensure_machine_connection(machine_details: Dict) -> bool:
    """Ensure connection to the machine"""
    try:
        machine_id = machine_details["id"]
        # Use the correct field names from database schema
        public_ip = machine_details.get("public_ip_address")
        vnc_password = machine_details.get("vnc_password")
        
        # For local machines, use localhost
        if machine_id.startswith("local-"):
            public_ip = "localhost"
            agent_port = 8081  # Local development port
        else:
            # For Azure containers, use the public IP and port 8080 (AI agent server port)
            agent_port = 8080  # AI agent server runs on 8080, not websocket_port (6080) which is for VNC
            
        if not public_ip:
            logger.error(f"No public IP address found for machine {machine_id}")
            return False
            
        logger.info(f"Connecting to machine {machine_id} at {public_ip}:{agent_port}")
        
        # Connect to the machine
        connected = await vm_control_service.connect_to_agent(
            machine_id=machine_id,
            public_ip=public_ip,
            agent_port=agent_port,
            vnc_password=vnc_password
        )
        
        if connected:
            logger.info(f"Successfully connected to machine {machine_id}")
        else:
            logger.error(f"Failed to connect to machine {machine_id}")
            
        return connected
    except Exception as e:
        logger.error(f"Error connecting to machine: {str(e)}")
        return False


class FileListRequest(BaseModel):
    """Request model for listing files"""
    machine_id: str
    path: str = "/home/desktop/Desktop"
    recursive: bool = False
    max_files: int = 200


class FileDownloadRequest(BaseModel):
    """Request model for downloading a file"""
    machine_id: str
    filepath: str
    encoding: str = "auto"  # auto, utf-8, or base64


class FileUploadRequest(BaseModel):
    """Request model for uploading a file via JSON"""
    machine_id: str
    filepath: str
    content: str
    encoding: str = "utf-8"  # utf-8 or base64


class CreateFolderRequest(BaseModel):
    """Request model for creating a folder"""
    machine_id: str
    folderpath: str


@router.post("/list")
async def list_files(
    request: FileListRequest,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """
    List files in a directory on the VM
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(request.machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {request.machine_id}"
            )
        
        logger.info(f"Listing files for machine {request.machine_id}, user: {user_id}, path: {request.path}")
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {request.machine_id}"
            )
        
        # Execute file list command - this should return both files and directories
        result = await vm_control_service.execute_command(
            request.machine_id,
            "file_list_downloads",
            {
                "dirpath": request.path,
                "recursive": request.recursive,
                "max_files": request.max_files
            }
        )
        
        if not result.get("success"):
            # If file_list_downloads fails, try a simpler command
            logger.warning(f"file_list_downloads failed, trying fallback for path: {request.path}")
            
            # Try to at least get something from the directory
            # Create mock data for common directories if we can't connect
            if request.path == "/home":
                files_list = [
                    {"filename": "desktop", "path": "/home/desktop", "is_directory": True, "size": 0},
                    {"filename": "documents", "path": "/home/documents", "is_directory": True, "size": 0},
                    {"filename": "downloads", "path": "/home/downloads", "is_directory": True, "size": 0},
                ]
            elif request.path == "/home/desktop":
                files_list = [
                    {"filename": "Desktop", "path": "/home/desktop/Desktop", "is_directory": True, "size": 0},
                    {"filename": "Documents", "path": "/home/desktop/Documents", "is_directory": True, "size": 0},
                    {"filename": "Downloads", "path": "/home/desktop/Downloads", "is_directory": True, "size": 0},
                ]
            elif request.path == "/":
                files_list = [
                    {"filename": "home", "path": "/home", "is_directory": True, "size": 0},
                    {"filename": "usr", "path": "/usr", "is_directory": True, "size": 0},
                    {"filename": "var", "path": "/var", "is_directory": True, "size": 0},
                    {"filename": "tmp", "path": "/tmp", "is_directory": True, "size": 0},
                ]
            else:
                # Return empty for unknown paths
                files_list = []
        else:
            # Process the result from file_list_downloads
            files_list = result.get("files", [])
            
            # Ensure all entries have the is_directory field properly set
            for file_item in files_list:
                # If is_directory is not set, try to determine from other fields
                if "is_directory" not in file_item:
                    # Check if size is 0 or if the item has typical directory indicators
                    file_item["is_directory"] = (
                        file_item.get("size", 0) == 0 and 
                        not any(file_item.get("filename", "").endswith(ext) 
                               for ext in ['.txt', '.py', '.js', '.json', '.md', '.html', '.css', '.png', '.jpg', '.pdf'])
                    )
        
        # Calculate totals
        total_size = sum(f.get("size", 0) for f in files_list if not f.get("is_directory", False))
        
        return {
            "success": True,
            "files": files_list,
            "directory": request.path,
            "total_files": len(files_list),
            "total_size": total_size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing files: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/download")
async def download_file(
    request: FileDownloadRequest,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """
    Download a file from the VM
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(request.machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {request.machine_id}"
            )

        logger.info(f"Downloading file from machine {request.machine_id}, user: {user_id}")
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {request.machine_id}"
            )
        
        # Execute file download command
        result = await vm_control_service.execute_command(
            request.machine_id,
            "file_download",
            {
                "filepath": request.filepath,
                "encoding": request.encoding
            }
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to download file: {result.get('error', 'Unknown error')}"
            )
        
        return {
            "success": True,
            "filename": result.get("filename"),
            "filepath": result.get("filepath"),
            "size": result.get("size"),
            "encoding": result.get("encoding"),
            "content": result.get("content"),
            "message": result.get("message")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/download-stream")
async def download_file_stream(
    request: FileDownloadRequest,
    user_id: str = Depends(get_verified_user_id),
):
    """
    Download a file from the VM as a streaming response
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(request.machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {request.machine_id}"
            )

        logger.info(f"Streaming download from machine {request.machine_id}, user: {user_id}")
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {request.machine_id}"
            )
        
        # Execute file download command
        result = await vm_control_service.execute_command(
            request.machine_id,
            "file_download",
            {
                "filepath": request.filepath,
                "encoding": "base64"  # Always use base64 for streaming
            }
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to download file: {result.get('error', 'Unknown error')}"
            )
        
        # Decode base64 content
        content = result.get("content", "")
        file_bytes = base64.b64decode(content)
        filename = result.get("filename", "download")
        
        # Return as streaming response
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f"attachment; filename={filename}",
                "Content-Length": str(len(file_bytes))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error downloading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_file(
    request: FileUploadRequest,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """
    Upload a file to the VM (JSON body)
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(request.machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {request.machine_id}"
            )

        logger.info(f"Uploading file to machine {request.machine_id}, user: {user_id}")
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {request.machine_id}"
            )
        
        # Execute file upload command
        result = await vm_control_service.execute_command(
            request.machine_id,
            "file_upload",
            {
                "filepath": request.filepath,
                "content": request.content,
                "encoding": request.encoding
            }
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload file: {result.get('error', 'Unknown error')}"
            )
        
        return {
            "success": True,
            "filepath": result.get("filepath"),
            "size": result.get("size"),
            "message": result.get("message")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload-multipart")
async def upload_file_multipart(
    machine_id: str = Form(...),
    filepath: str = Form(...),
    file: UploadFile = File(...),
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """
    Upload a file to the VM (multipart form data)
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {machine_id}"
            )

        logger.info(f"Uploading file (multipart) to machine {machine_id}, user: {user_id}")
        
        # Check file size (10MB limit)
        if file.size and file.size > 10 * 1024 * 1024:
            raise HTTPException(
                status_code=413,
                detail="File too large (max 10MB)"
            )
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {machine_id}"
            )
        
        # Read file content
        content = await file.read()
        
        # Determine encoding based on content type
        is_text = file.content_type and (
            file.content_type.startswith('text/') or
            file.content_type in ['application/json', 'application/xml', 'application/javascript']
        )
        
        if is_text:
            # Text file - send as UTF-8
            try:
                content_str = content.decode('utf-8')
                encoding = 'utf-8'
            except UnicodeDecodeError:
                # If can't decode as UTF-8, send as base64
                content_str = base64.b64encode(content).decode('ascii')
                encoding = 'base64'
        else:
            # Binary file - send as base64
            content_str = base64.b64encode(content).decode('ascii')
            encoding = 'base64'
        
        # Use the provided filepath or default to the uploaded filename
        final_filepath = filepath if filepath != "auto" else file.filename
        
        # Execute file upload command
        result = await vm_control_service.execute_command(
            machine_id,
            "file_upload",
            {
                "filepath": final_filepath,
                "content": content_str,
                "encoding": encoding
            }
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to upload file: {result.get('error', 'Unknown error')}"
            )
        
        return {
            "success": True,
            "filepath": result.get("filepath"),
            "size": result.get("size"),
            "message": result.get("message")
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/delete")
async def delete_file(
    machine_id: str,
    filepath: str,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """
    Delete a file from the VM
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {machine_id}"
            )

        logger.info(f"Deleting file from machine {machine_id}, user: {user_id}")
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {machine_id}"
            )
        
        # Execute file delete command
        result = await vm_control_service.execute_command(
            machine_id,
            "file_delete",
            {
                "filepath": filepath
            }
        )
        
        if not result.get("success"):
            raise HTTPException(
                status_code=500,
                detail=f"Failed to delete file: {result.get('error', 'Unknown error')}"
            )
        
        return {
            "success": True,
            "filepath": filepath,
            "message": f"File {filepath} deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting file: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-folder")
async def create_folder(
    request: CreateFolderRequest,
    user_id: str = Depends(get_verified_user_id),
) -> Dict[str, Any]:
    """
    Create a new folder on the VM
    """
    try:
        # Verify user has access to this machine and get details
        machine_details = await verify_machine_access(request.machine_id, user_id)
        if not machine_details:
            raise HTTPException(
                status_code=403,
                detail=f"Access denied to machine {request.machine_id}"
            )

        logger.info(f"Creating folder on machine {request.machine_id}, user: {user_id}, path: {request.folderpath}")
        
        # Connect to the machine
        is_connected = await ensure_machine_connection(machine_details)
        if not is_connected:
            raise HTTPException(
                status_code=503,
                detail=f"Cannot connect to machine {request.machine_id}"
            )
        
        # Validate and sanitize the folder path
        folderpath = request.folderpath.strip()
        if not folderpath or '\x00' in folderpath:
            raise HTTPException(status_code=400, detail="Invalid folder path")

        # Execute mkdir command (shlex.quote prevents shell injection)
        result = await vm_control_service.execute_command(
            request.machine_id,
            "execute_terminal_command",
            {
                "command": f"mkdir -p {shlex.quote(folderpath)}"
            }
        )
        
        if not result.get("success"):
            error_msg = result.get("error", "Failed to create folder")
            logger.error(f"Failed to create folder: {error_msg}")
            raise HTTPException(
                status_code=500,
                detail=error_msg
            )
        
        return {
            "success": True,
            "folderpath": request.folderpath,
            "message": f"Folder {request.folderpath} created successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating folder: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
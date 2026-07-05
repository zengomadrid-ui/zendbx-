"""
Email Service
Handles all email sending functionality for ZenDBX
"""

import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
from typing import Optional, List
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Centralized email service for ZenDBX
    Supports multiple email types: welcome, password reset, verification, etc.
    """
    
    def __init__(self):
        # Setup Jinja2 template environment
        template_dir = Path(__file__).parent.parent / "templates" / "emails"
        self.env = Environment(loader=FileSystemLoader(str(template_dir)))
        
        # Email configuration from environment
        self.smtp_host = settings.EMAIL_HOST
        self.smtp_port = settings.EMAIL_PORT
        self.smtp_user = settings.EMAIL_USER
        self.smtp_password = settings.EMAIL_PASSWORD
        self.from_email = settings.EMAIL_FROM
        self.use_tls = settings.EMAIL_USE_TLS
        
        logger.info(f"📧 Email service initialized with SMTP: {self.smtp_host}:{self.smtp_port}")
    
    def _get_smtp_connection(self) -> smtplib.SMTP:
        """
        Create and return SMTP connection
        Handles TLS and authentication
        """
        try:
            smtp = smtplib.SMTP(self.smtp_host, self.smtp_port, timeout=10)
            smtp.ehlo()
            
            if self.use_tls:
                smtp.starttls()
                smtp.ehlo()
            
            smtp.login(self.smtp_user, self.smtp_password)
            return smtp
            
        except Exception as e:
            logger.error(f"❌ Failed to connect to SMTP server: {str(e)}")
            raise
    
    def _render_template(self, template_name: str, context: dict) -> str:
        """
        Render email template with context
        """
        try:
            template = self.env.get_template(template_name)
            return template.render(**context)
        except Exception as e:
            logger.error(f"❌ Failed to render template {template_name}: {str(e)}")
            raise
    
    def send_email(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        retry_count: int = 3,
        attach_logo: bool = True
    ) -> bool:
        """
        Send email with retry logic
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML email body
            retry_count: Number of retry attempts (default: 3)
            attach_logo: Whether to attach the logo image (default: True)
            
        Returns:
            bool: True if email sent successfully, False otherwise
        """
        attempt = 0
        last_error = None
        
        while attempt < retry_count:
            attempt += 1
            
            try:
                logger.info(f"📧 Sending email to {to_email} (attempt {attempt}/{retry_count})")
                
                # Create message
                msg = MIMEMultipart('related')
                msg['Subject'] = subject
                msg['From'] = self.from_email
                msg['To'] = to_email
                
                # Attach HTML content
                html_part = MIMEText(html_content, 'html')
                msg.attach(html_part)
                
                # Attach logo image if requested
                if attach_logo:
                    try:
                        # Try to load logo from frontend folder
                        logo_path = Path(__file__).parent.parent.parent.parent / "frontend" / "AURIX-3.png"
                        
                        if logo_path.exists():
                            with open(logo_path, 'rb') as f:
                                logo_data = f.read()
                                logo_image = MIMEImage(logo_data)
                                logo_image.add_header('Content-ID', '<logo>')
                                logo_image.add_header('Content-Disposition', 'inline', filename='logo.png')
                                msg.attach(logo_image)
                                logger.info(f"✅ Logo attached from: {logo_path}")
                        else:
                            logger.warning(f"⚠️ Logo not found at: {logo_path}")
                    except Exception as e:
                        logger.warning(f"⚠️ Could not attach logo: {str(e)}")
                
                # Send email
                with self._get_smtp_connection() as smtp:
                    smtp.send_message(msg)
                
                logger.info(f"✅ Email sent successfully to {to_email}")
                return True
                
            except Exception as e:
                last_error = str(e)
                logger.warning(f"⚠️ Email send attempt {attempt} failed: {last_error}")
                
                if attempt >= retry_count:
                    logger.error(f"❌ Failed to send email to {to_email} after {retry_count} attempts: {last_error}")
                    return False
        
        return False
    
    async def send_welcome_email(self, user_email: str, user_name: str) -> bool:
        """
        Send welcome email to new user
        
        Args:
            user_email: User's email address
            user_name: User's name (or email if name not available)
            
        Returns:
            bool: True if email sent successfully
        """
        try:
            logger.info(f"🎉 Preparing welcome email for {user_email}")
            
            # Prepare template context
            context = {
                "user_name": user_name,
                "dashboard_url": "https://zendbx.in/dashboard",
                "docs_url": "https://docs.zendbx.in",
                "support_email": "zendbx@gmail.com",
                "year": "2026"
            }
            
            # Render email template
            html_content = self._render_template("welcome.html", context)
            
            # Send email with logo attached
            subject = "🚀 Welcome to ZenDBX!"
            success = self.send_email(user_email, subject, html_content, attach_logo=True)
            
            if success:
                logger.info(f"✅ Welcome email sent to {user_email}")
            else:
                logger.error(f"❌ Failed to send welcome email to {user_email}")
            
            return success
            
        except Exception as e:
            logger.error(f"❌ Error preparing welcome email for {user_email}: {str(e)}")
            return False
    
    async def send_password_reset_email(self, user_email: str, reset_token: str) -> bool:
        """
        Send password reset email
        Future implementation
        """
        # TODO: Implement password reset email
        pass
    
    async def send_verification_email(self, user_email: str, verification_token: str) -> bool:
        """
        Send email verification
        Future implementation
        """
        # TODO: Implement verification email
        pass
    
    async def send_team_invite_email(
        self,
        user_email: str,
        inviter_name: str,
        project_name: str,
        invite_link: str
    ) -> bool:
        """
        Send team invitation email
        Future implementation
        """
        # TODO: Implement team invite email
        pass
    
    async def send_billing_email(self, user_email: str, invoice_data: dict) -> bool:
        """
        Send billing/invoice email
        Future implementation
        """
        # TODO: Implement billing email
        pass
    
    async def send_notification_email(self, user_email: str, notification_data: dict) -> bool:
        """
        Send general notification email
        Future implementation
        """
        # TODO: Implement notification email
        pass


# Singleton instance
_email_service = None


def get_email_service() -> EmailService:
    """
    Get or create email service singleton
    """
    global _email_service
    if _email_service is None:
        _email_service = EmailService()
    return _email_service

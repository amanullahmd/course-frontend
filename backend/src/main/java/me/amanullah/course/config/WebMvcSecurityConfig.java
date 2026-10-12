package me.amanullah.course.config;

import me.amanullah.course.security.InstructorApprovalInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** Registers MVC interceptors that enforce account rules (instructor approval). */
@Configuration
public class WebMvcSecurityConfig implements WebMvcConfigurer {

    private final InstructorApprovalInterceptor instructorApproval;

    public WebMvcSecurityConfig(InstructorApprovalInterceptor instructorApproval) {
        this.instructorApproval = instructorApproval;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(instructorApproval).addPathPatterns(InstructorApprovalInterceptor.PATTERN);
    }
}

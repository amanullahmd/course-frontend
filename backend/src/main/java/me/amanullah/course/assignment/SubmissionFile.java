package me.amanullah.course.assignment;

import me.amanullah.course.media.MediaAsset;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;

/** A file of a submission: uploaded by the learner, or attached by the instructor to the feedback. */
@Embeddable
public class SubmissionFile {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "media_id", nullable = false)
    private MediaAsset media;

    @Column(name = "feedback_file", nullable = false)
    private boolean feedbackFile;

    protected SubmissionFile() {
    }

    public SubmissionFile(MediaAsset media, boolean feedbackFile) {
        this.media = media;
        this.feedbackFile = feedbackFile;
    }

    public MediaAsset getMedia() { return media; }
    public boolean isFeedbackFile() { return feedbackFile; }
}

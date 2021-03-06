package org.coinvent.data;

import java.io.File;

import com.winterwell.utils.threads.ATask.QStatus;



public interface IJob {

	Object getResult();

	QStatus getStatus();

	Id getId();

	Id getActor();

	/**
	 * @return e.g. "blend"
	 */
	String getComponent();

	void setResult(Object jobj);

	void setStatus(QStatus status);
}
